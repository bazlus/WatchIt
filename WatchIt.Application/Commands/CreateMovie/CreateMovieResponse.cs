using WatchIt.Application.Common;
using WatchIt.Domain.Models;

namespace WatchIt.Application.Commands.CreateMovie
{
    public class CreateMovieResponse : IMapFrom<Movie>
    {
        public int Id { get; set; }
    }
}
